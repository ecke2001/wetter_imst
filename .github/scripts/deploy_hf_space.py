"""
Upload the built app folder to a Hugging Face Space (static SDK).

Env:
  HF_TOKEN  Hugging Face write token (GitHub secret). Never printed.
  HF_SPACE  Optional "user/space" id; defaults to "<token owner>/wetter_imst".
  GIT_SHA   Commit being deployed (for the Space commit message).

Usage: python deploy_hf_space.py <folder>
"""
import os
import sys

from huggingface_hub import HfApi

# Old app assets on the Space that are not part of this upload get removed
# (e.g. a service worker or manifest from earlier PWA versions). Files uploaded
# in the same commit are kept; README.md and .gitattributes are not touched.
STALE_PATTERNS = ["*.html", "*.css", "*.js", "*.json", "*.webmanifest", "*.svg", "*.png", "*.ico"]


def main(folder: str) -> int:
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        print("::warning::HF_TOKEN secret is not set, skipping Hugging Face deploy.")
        return 0

    api = HfApi(token=token)
    space = os.environ.get("HF_SPACE", "").strip() or f"{api.whoami()['name']}/wetter_imst"
    sha = os.environ.get("GIT_SHA", "")[:7] or "local"

    api.create_repo(space, repo_type="space", space_sdk="static", exist_ok=True)
    api.upload_folder(
        repo_id=space,
        repo_type="space",
        folder_path=folder,
        commit_message=f"Deploy {sha} from GitHub",
        delete_patterns=STALE_PATTERNS,
    )
    print(f"Deployed to https://huggingface.co/spaces/{space}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
