# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The IfcOpenShell check of an exported Buddy model (ROAD-3583). Test-time only: IfcOpenShell is LGPL and
never vendored, never loaded by the page. The same bytes in EDITORS.AdapterBuddy, EDITORS.PortBuddy and
EDITORS.PortalBuddy.

    python3 -I scripts/validate-ifc.py model.ifc [more.ifc ...]

prints one JSON object per file:
  schema         FILE_SCHEMA (IFC4X3_ADD2)
  statements     ifcopenshell.validate with express_rules=True: every schema and where-rule finding
  pset_problems  every Pset_/Qto_ against the IFC4X3 templates and every APK_ set against apk_psets.py,
                 by the BIM repo's oracle (tools/ifc/oracle.py) when it is beside this app
  connections    oracle.connection_problems: every IfcRelConnectsPorts runs SOURCE -> SINK
  ids_failed     the apk-av.ids specifications this file fails (name, applicable count, first reason)
  ports          per IfcDistributionPort: Name, FlowDirection, PredefinedType, its host's class (IfcRelNests)
Exit status 1 when any file has a statement, a Pset problem or a connection problem.
"""
import json
import sys
from pathlib import Path

import ifcopenshell
import ifcopenshell.validate

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parents[4] / "POD.database/DATABASE.server.BIM/SRC/tools/ifc"


def _oracle():
    if (TOOLS / "oracle.py").exists():
        sys.path.insert(0, str(TOOLS))
        import oracle  # noqa: E402
        return oracle
    return None


def statements(f):
    log = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(f, log, express_rules=True)
    return [str(s.get("message", s)) if isinstance(s, dict) else str(s) for s in log.statements]


def ports(f):
    out = []
    for p in f.by_type("IfcDistributionPort"):
        hosts = [r.RelatingObject.is_a() for r in (p.Nests or [])]
        out.append({"name": p.Name, "flow": p.FlowDirection, "type": p.PredefinedType, "system": p.SystemType, "host": hosts[0] if hosts else None})
    return out


def main(paths):
    oracle = _oracle()
    worst = 0
    for path in paths:
        f = ifcopenshell.open(path)
        st = statements(f)
        pp = oracle.pset_problems(f) if oracle else []
        cp = oracle.connection_problems(f) if oracle and hasattr(oracle, "connection_problems") else []
        ids_failed = [[n, a, why[:1]] for n, ok, a, why in oracle.ids_results(f) if not ok] if oracle else []
        print(json.dumps({"file": path, "schema": f.schema_identifier, "statements": len(st), "first": st[:5],
                          "pset_problems": pp, "connections": cp, "ids_failed": ids_failed, "ports": ports(f),
                          "oracle": bool(oracle)}))
        if st or pp or cp:
            worst = 1
    return worst


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
