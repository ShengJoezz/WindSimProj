import json
import re
from pathlib import Path


def load_profile():
    info = json.loads(Path("../info.json").read_text(encoding="utf-8"))
    return str(info.get("wind", {}).get("profile", "uniform")).strip().lower()


def replace_patch_type(boundary_text, patch_name, new_type):
    pattern = rf"(\n\s*{re.escape(patch_name)}\s*\n\s*\{{.*?\n\s*type\s+)(\w+)(;)"

    def repl(match):
        return f"{match.group(1)}{new_type}{match.group(3)}"

    updated, count = re.subn(pattern, repl, boundary_text, flags=re.DOTALL)
    if count == 0:
        raise RuntimeError(f"Failed to locate patch '{patch_name}' in constant/polyMesh/boundary")
    return updated


def replace_field_boundary_type(field_text, patch_name, old_type, new_type):
    pattern = rf"(\n\s*{re.escape(patch_name)}\s*\n\s*\{{.*?\n\s*type\s+){old_type}(;)"
    return re.sub(pattern, rf"\1{new_type}\2", field_text, flags=re.DOTALL)


def ensure_nut_top_entry(field_text):
    if "\n    top\n    {" in field_text:
        return field_text

    include_line = '    #includeEtc "caseDicts/setConstraintTypes"'
    top_block = """    top
    {
        type            calculated;
        value           uniform 0;
    }

"""
    if include_line not in field_text:
        raise RuntimeError("Failed to locate setConstraintTypes include in 0/nut")
    return field_text.replace(include_line, top_block + include_line)


def main():
    profile = load_profile()
    if profile != "abl_log":
        print(f"[INFO] Boundary patch adjustment skipped for profile={profile}")
        return

    boundary_path = Path("constant/polyMesh/boundary")
    text = boundary_path.read_text(encoding="utf-8")
    updated = replace_patch_type(text, "top", "patch")
    boundary_path.write_text(updated, encoding="utf-8")
    print("[INFO] Updated constant/polyMesh/boundary: top patch type set to 'patch' for ABL inflow")

    zero_dir = Path("0")
    updated_files = []
    for field_path in zero_dir.iterdir():
        if not field_path.is_file():
            continue
        text = field_path.read_text(encoding="utf-8")
        new_text = replace_field_boundary_type(text, "top", "symmetry", "zeroGradient")
        if field_path.name == "nut":
            new_text = ensure_nut_top_entry(new_text)
        if new_text != text:
            field_path.write_text(new_text, encoding="utf-8")
            updated_files.append(field_path.name)

    if updated_files:
        print("[INFO] Updated top boundary type symmetry->zeroGradient in:", ", ".join(sorted(updated_files)))


if __name__ == "__main__":
    main()
