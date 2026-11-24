#!/usr/bin/env python3
"""Check proposal bookkeeping, NOT model behavior or truth of evidence.

Default: validate proposal structure. --ready: require all gate reports.
--self-test: tamper with isolated fixtures; never calls an API or edits configs.
Evidence entries: {"path": "relative/path", "sha256": "..."}.
Human/independent review of report content remains mandatory.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {"iran", "protocol", "memory", "rules", "tools", "routing", "quality_cost", "recovery"}


def errors(data, base, ready=False):
    problems = []
    if data.get("scope") != "api_only":
        problems.append("scope must be api_only")
    if data.get("acceptance_confirmed_by_habib") is not True:
        problems.append("acceptance is not confirmed")
    if type(data.get("migration_executed")) is not bool:
        problems.append("migration_executed must be boolean")
    gates = data.get("gates")
    if not isinstance(gates, list) or any(not isinstance(g, dict) for g in gates):
        return problems + ["gates must be a list of records"]
    ids = [g.get("id") for g in gates]
    if any(not isinstance(i, str) for i in ids) or set(ids) != REQUIRED or len(ids) != len(REQUIRED):
        problems.append("missing, duplicate or unknown gate")
    for gate in gates:
        name = gate.get("id", "?")
        status = gate.get("status")
        evidence = gate.get("evidence")
        if status not in {"not_run", "failed", "passed"}:
            problems.append(f"{name}: invalid status")
        if not isinstance(evidence, list):
            problems.append(f"{name}: evidence must be a list")
            continue
        if status == "passed" and not evidence:
            problems.append(f"{name}: passed without evidence")
        for entry in evidence:
            if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
                problems.append(f"{name}: invalid evidence entry")
                continue
            file = (base / entry["path"]).resolve()
            if not file.is_relative_to(base.resolve()) or not file.is_file():
                problems.append(f"{name}: evidence missing or outside project")
                continue
            if hashlib.sha256(file.read_bytes()).hexdigest() != entry.get("sha256"):
                problems.append(f"{name}: evidence changed")
        if ready and status != "passed":
            problems.append(f"{name}: {status}")
    if ready and data.get("migration_executed") is not True:
        problems.append("migration not executed")
    return problems


def self_test(data):
    # A valid isolated record establishes that failures below detect tampering.
    with tempfile.TemporaryDirectory(prefix="migration-plan-check-") as directory:
        base = Path(directory)
        report = base / "fixture.txt"
        report.write_text("synthetic checker fixture; not a real migration\n")
        reference = {"path": report.name, "sha256": hashlib.sha256(report.read_bytes()).hexdigest()}
        good = copy.deepcopy(data)
        good["migration_executed"] = True
        for gate in good["gates"]:
            gate.update(status="passed", evidence=[reference.copy()])
        assert not errors(good, base, ready=True), "valid fixture rejected"
        broken = copy.deepcopy(good)
        broken["gates"].pop()
        assert errors(broken, base, ready=True), "missing gate was accepted"
        broken = copy.deepcopy(good)
        broken["gates"][0]["evidence"] = []
        assert errors(broken, base, ready=True), "unsupported pass was accepted"
        broken = copy.deepcopy(good)
        broken["gates"][0]["status"] = "failed"
        assert errors(broken, base, ready=True), "failed gate was accepted"
        report.write_text("intentionally corrupted evidence\n")
        assert errors(good, base, ready=True), "modified evidence was accepted"
    print("Checker fixture passed; four deliberate corruptions rejected. No migration tested.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ready", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--manifest", type=Path, default=ROOT / "doc-tarif/tarif/readiness.json")
    args = parser.parse_args()
    try:
        data = json.loads(args.manifest.read_text())
        if not isinstance(data, dict):
            raise ValueError("manifest must be an object")
        problems = errors(data, ROOT, ready=args.ready)
        for name in ["01-migration-plan.md", "02-user-experiences.md"]:
            if not (ROOT / "doc-tarif/tarif" / name).is_file():
                problems.append(f"missing proposal file: {name}")
        if problems:
            print("\n".join(problems))
            return 1
        if args.self_test:
            self_test(data)
        print("Evidence bookkeeping complete; manual review required." if args.ready else
              "Proposal structure valid. Migration readiness is NOT established; use --ready.")
        return 0
    except (OSError, ValueError, TypeError, AssertionError) as error:
        print(f"Check failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
