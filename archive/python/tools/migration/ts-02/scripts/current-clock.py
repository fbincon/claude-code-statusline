"""Compare the explicitly fixed working Python clock; never replace the oracle."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "src"))
from claude_statusline.platforms.clocks import now_clocks
from claude_statusline.platforms.processes import process_start_token

wall, boot, domain = now_clocks()
print(json.dumps(dict(wall_ns=wall, boot_ns=boot, boot_id=domain,
                     token=process_start_token(int(sys.argv[1])))))
