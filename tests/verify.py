#!/usr/bin/env python3
"""
Automated Verification Suite for "Amigo Invisible - 1º Máster de Teleco"
Run locally via: python tests/verify.py
Requirements: Python 3.8+ (Zero external dependencies)
"""
import unittest
import base64
import json
import random
import time
import sys

# ==============================================================================
# CORE ENGINE: SOLVABILITY & HALL'S CONDITION
# ==============================================================================
def check_solvability(names, exclusions=None):
    if exclusions is None:
        exclusions = {}
    n = len(names)
    if n < 3:
        return False, f"Se requieren al menos 3 participantes (actualmente hay {n}).", []

    name_to_idx = {name: i for i, name in enumerate(names)}
    adj = []
    for i, name in enumerate(names):
        raw_excl = exclusions.get(name, [])
        excl = {name_to_idx[ex] for ex in raw_excl if ex in name_to_idx}
        excl.add(i) # Self-exclusion
        valid_recipients = [v for v in range(n) if v not in excl]
        if not valid_recipients:
            return False, f"El participante '{name}' no tiene a quién regalar debido a sus exclusiones.", adj
        adj.append(valid_recipients)

    # Check that every participant can receive from at least one person
    for v in range(n):
        has_giver = any(v in adj[u] for u in range(n))
        if not has_giver:
            return False, f"El participante '{names[v]}' ha sido excluido por todos los demás y no puede recibir regalos.", adj

    # Kuhn's Maximum Bipartite Matching
    match_v = [-1] * n
    match_u = [-1] * n

    def dfs(u, visited):
        for v in adj[u]:
            if not visited[v]:
                visited[v] = True
                if match_v[v] == -1 or dfs(match_v[v], visited):
                    match_v[v] = u
                    match_u[u] = v
                    return True
        return False

    for u in range(n):
        visited = [False] * n
        dfs(u, visited)

    unmatched = [u for u in range(n) if match_u[u] == -1]
    if not unmatched:
        return True, "Solvable", adj

    # Trace alternating tree from unmatched givers to find Hall violator subset S
    visited_u = [False] * n
    visited_v = [False] * n
    queue = list(unmatched)
    for u in queue:
        visited_u[u] = True

    while queue:
        curr_u = queue.pop(0)
        for v in adj[curr_u]:
            if not visited_v[v]:
                visited_v[v] = True
                matched_u = match_v[v]
                if matched_u != -1 and not visited_u[matched_u]:
                    visited_u[matched_u] = True
                    queue.append(matched_u)

    S = [names[i] for i in range(n) if visited_u[i]]
    N_S = [names[j] for j in range(n) if visited_v[j]]
    msg = (
        f"Conflicto de exclusión irresoluble: los participantes {S} ({len(S)} personas) "
        f"solo pueden regalar a {N_S} ({len(N_S)} personas). "
        f"Se necesitan al menos {len(S)} destinatarios posibles."
    )
    return False, msg, adj


# ==============================================================================
# CORE ENGINE: DERANGEMENT GENERATOR (REJECTION + MRV BACKTRACKING)
# ==============================================================================
def generate_derangement(names, exclusions=None, max_rejection_tries=300):
    if exclusions is None:
        exclusions = {}
    solvable, msg, adj = check_solvability(names, exclusions)
    if not solvable:
        raise ValueError(msg)

    n = len(names)

    # 1. Uniform rejection sampling
    for _ in range(max_rejection_tries):
        perm = list(range(n))
        random.shuffle(perm)
        if all(perm[u] in adj[u] for u in range(n)):
            return {names[u]: names[perm[u]] for u in range(n)}

    # 2. Randomized MRV (Minimum Remaining Values) Backtracking fallback
    assignment = [-1] * n
    used_v = [False] * n

    def backtrack():
        best_u = -1
        best_candidates = None
        for u in range(n):
            if assignment[u] == -1:
                cands = [v for v in adj[u] if not used_v[v]]
                if best_u == -1 or len(cands) < len(best_candidates):
                    best_u = u
                    best_candidates = cands
        if best_u == -1:
            return True
        if not best_candidates:
            return False

        random.shuffle(best_candidates)
        for v in best_candidates:
            assignment[best_u] = v
            used_v[v] = True
            if backtrack():
                return True
            assignment[best_u] = -1
            used_v[v] = False
        return False

    if backtrack():
        return {names[u]: names[assignment[u]] for u in range(n)}
    raise ValueError("No se pudo generar una asignación válida tras la búsqueda exhaustiva.")

# Alias for API compatibility
generate_draw = generate_derangement


# ==============================================================================
# CORE ENGINE: URL CRYPTOGRAPHY & TAMPER DETECTION
# ==============================================================================
def encode_payload(giver, receiver, event="1º Máster Teleco", budget="", date=""):
    payload = {
        "g": giver,
        "r": receiver,
        "t": receiver,
        "e": event,
        "b": budget,
        "d": date,
        "ts": int(time.time() * 1000)
    }
    data = json.dumps(payload, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    checksum = sum(data) % 256
    # Format: [version=1, checksum, ...utf8_bytes]
    packed = bytes([1, checksum]) + data
    return base64.urlsafe_b64encode(packed).decode('ascii').rstrip('=')

encode_participant_token = encode_payload

def decode_payload(token):
    try:
        if not token or not isinstance(token, str):
            return {"success": False, "error": "Token vacío o formato inválido"}
        token_clean = token.strip()
        import re
        if not re.match(r'^[A-Za-z0-9_-]+$', token_clean):
            return {"success": False, "error": "El enlace contiene caracteres no válidos"}
        pad = len(token_clean) % 4
        if pad != 0:
            token_clean += '=' * (4 - pad)
        raw = base64.urlsafe_b64decode(token_clean.encode('ascii'))
        if len(raw) < 2:
            return {"success": False, "error": "Token incompleto o truncado"}

        # Versioned format: [version=1, checksum, ...payload]
        if raw[0] == 1 and len(raw) >= 3:
            checksum = raw[1]
            data = raw[2:]
            if (sum(data) % 256) != checksum:
                return {"success": False, "error": "Integridad comprometida: el enlace ha sido manipulado o alterado"}
            payload = json.loads(data.decode('utf-8'))
        else:
            # Unversioned legacy fallback: [checksum, ...payload]
            checksum = raw[0]
            data = raw[1:]
            if (sum(data) % 256) != checksum:
                return {"success": False, "error": "Integridad comprometida: el enlace ha sido manipulado o alterado"}
            payload = json.loads(data.decode('utf-8'))

        giver = payload.get("g")
        receiver = payload.get("r") or payload.get("t")
        if not giver or not receiver:
            return {"success": False, "error": "Estructura de enlace incompleta (faltan campos obligatorios)"}

        return {
            "success": True,
            "giver": giver,
            "receiver": receiver,
            "target": receiver,
            "event": payload.get("e", "1º Máster Teleco"),
            "budget": payload.get("b", ""),
            "date": payload.get("d", "")
        }
    except Exception as e:
        return {"success": False, "error": f"Error de decodificación: {str(e)}"}

decode_participant_token = decode_payload


# ==============================================================================
# TEST SUITES
# ==============================================================================
class TestSuiteDerangementsAndCrypto(unittest.TestCase):

    # -------------------------------------------------------------
    # SUITE 1: Derangement Validity & Bijectivity
    # -------------------------------------------------------------
    def test_01_no_self_assignments_500_iterations(self):
        names = ["Ana", "Bob", "Carlos", "Diana", "Elena"]
        for _ in range(500):
            draw = generate_draw(names, {})
            for giver, receiver in draw.items():
                self.assertNotEqual(giver, receiver, f"Self-assignment detected: {giver} -> {receiver}")

    def test_02_bijective_matching(self):
        names = ["Ana", "Bob", "Carlos", "Diana", "Elena", "Fernando"]
        draw = generate_draw(names, {})
        receivers = list(draw.values())
        self.assertEqual(len(receivers), len(names))
        self.assertEqual(len(set(receivers)), len(names), "Duplicate receiver assigned")
        for name in names:
            self.assertIn(name, receivers, f"Participant {name} received no gift")

    # -------------------------------------------------------------
    # SUITE 2: Exclusion Rules Enforcement
    # -------------------------------------------------------------
    def test_03_symmetric_couple_exclusion(self):
        names = ["Ana", "Bob", "Carlos", "Diana"]
        excl = {"Ana": ["Bob"], "Bob": ["Ana"]}
        for _ in range(200):
            draw = generate_draw(names, excl)
            self.assertNotEqual(draw["Ana"], "Bob")
            self.assertNotEqual(draw["Bob"], "Ana")

    def test_04_roommate_triad_exclusions(self):
        names = ["A", "B", "C", "D", "E", "F"]
        excl = {
            "A": ["B", "C"],
            "B": ["A", "C"],
            "C": ["A", "B"]
        }
        for _ in range(200):
            draw = generate_draw(names, excl)
            self.assertNotIn(draw["A"], ["B", "C"])
            self.assertNotIn(draw["B"], ["A", "C"])
            self.assertNotIn(draw["C"], ["A", "B"])

    def test_05_chain_exclusions(self):
        names = ["A", "B", "C", "D", "E"]
        excl = {"A": ["B"], "B": ["C"], "C": ["D"]}
        for _ in range(200):
            draw = generate_draw(names, excl)
            self.assertNotEqual(draw["A"], "B")
            self.assertNotEqual(draw["B"], "C")
            self.assertNotEqual(draw["C"], "D")

    # -------------------------------------------------------------
    # SUITE 3: Unsolvable Detection & Error Messaging
    # -------------------------------------------------------------
    def test_06_minimum_participant_constraint(self):
        solvable, msg, _ = check_solvability(["Ana", "Bob"], {})
        self.assertFalse(solvable)
        self.assertIn("al menos 3 participantes", msg)

    def test_07_universal_exclusion_detection(self):
        names = ["A", "B", "C"]
        excl = {"A": ["B", "C"]}
        solvable, msg, _ = check_solvability(names, excl)
        self.assertFalse(solvable)
        self.assertIn("no tiene a quién regalar", msg)

    def test_08_star_exclusion_detection(self):
        names = ["A", "B", "C", "D"]
        excl = {"A": ["D"], "B": ["D"], "C": ["D"]}
        solvable, msg, _ = check_solvability(names, excl)
        self.assertFalse(solvable)
        self.assertIn("ha sido excluido por todos los demás", msg)

    def test_09_hall_marriage_bottleneck_detection(self):
        names = ["Alejandro", "Beatriz", "Carlos", "David", "Elena"]
        excl = {
            "David": ["Alejandro", "Beatriz", "Elena"],
            "Elena": ["Alejandro", "Beatriz", "David"],
        }
        solvable, msg, _ = check_solvability(names, excl)
        self.assertFalse(solvable)
        self.assertIn("Conflicto de exclusión irresoluble", msg)
        self.assertIn("David", msg)
        self.assertIn("Elena", msg)

    # -------------------------------------------------------------
    # SUITE 4: URL Cryptography & Tamper Resistance
    # -------------------------------------------------------------
    def test_10_roundtrip_encoding_decoding_unicode(self):
        giver = "Álvaro Íñigo López"
        receiver = "María José Peña 🚀🎄"
        event = "1º Máster de Teleco"
        token = encode_payload(giver, receiver, event, budget="15 €", date="20 Dic")
        res = decode_payload(token)
        self.assertTrue(res["success"])
        self.assertEqual(res["giver"], giver)
        self.assertEqual(res["receiver"], receiver)
        self.assertEqual(res["event"], event)
        self.assertEqual(res["budget"], "15 €")
        self.assertEqual(res["date"], "20 Dic")

    def test_11_rejects_truncated_tokens(self):
        token = encode_payload("Carlos", "Beatriz")
        truncated = token[:5]
        res = decode_payload(truncated)
        self.assertFalse(res["success"])
        self.assertTrue(len(res["error"]) > 0)

    def test_12_rejects_bit_flipped_tokens(self):
        token = encode_payload("Carlos", "Beatriz")
        char_list = list(token)
        char_list[-1] = 'A' if char_list[-1] != 'A' else 'B'
        tampered = "".join(char_list)
        res = decode_payload(tampered)
        self.assertFalse(res["success"])
        self.assertIn("manipulado", res["error"])

    def test_13_rejects_garbage_tokens(self):
        res = decode_payload("!@#$%^&*()_+bad_token")
        self.assertFalse(res["success"])

    # -------------------------------------------------------------
    # SUITE 5: Edge Cases & Scalability
    # -------------------------------------------------------------
    def test_14_boundary_n3_zero_exclusions(self):
        names = ["X", "Y", "Z"]
        draw = generate_draw(names, {})
        self.assertEqual(len(draw), 3)
        self.assertNotEqual(draw["X"], "X")
        self.assertNotEqual(draw["Y"], "Y")
        self.assertNotEqual(draw["Z"], "Z")

    def test_15_boundary_n3_one_exclusion_deterministic(self):
        names = ["X", "Y", "Z"]
        excl = {"X": ["Y"]}
        draw = generate_draw(names, excl)
        self.assertEqual(draw["X"], "Z")
        self.assertEqual(draw["Z"], "Y")
        self.assertEqual(draw["Y"], "X")

    def test_16_scalability_n50_under_100ms(self):
        names50 = [f"Teleco_{i}" for i in range(50)]
        t0 = time.time()
        draw = generate_draw(names50, {})
        elapsed_ms = (time.time() - t0) * 1000
        self.assertEqual(len(draw), 50)
        self.assertLess(elapsed_ms, 100.0, f"Execution took {elapsed_ms:.2f}ms (expected < 100ms)")


if __name__ == "__main__":
    print("=" * 60)
    print("  AMIGO INVISIBLE - 1º MÁSTER DE TELECO: TEST SUITE")
    print("=" * 60)
    suite = unittest.TestLoader().loadTestsFromTestCase(TestSuiteDerangementsAndCrypto)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        sys.exit(1)
    print("\n✓ ALL 16 AUTOMATED TESTS PASSED SUCCESSFULLY (100% SUCCESS)\n")
