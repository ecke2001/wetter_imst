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
from huggingface_hub.errors import HfHubHTTPError

# Old app assets on the Space that are not part of this upload get removed
# (e.g. a service worker or manifest from earlier PWA versions). Files uploaded
# in the same commit are kept; README.md and .gitattributes are not touched.
STALE_PATTERNS = ["*.html", "*.css", "*.js", "*.json", "*.webmanifest", "*.svg", "*.png", "*.ico"]


def main(folder: str) -> int:
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        print("::warning::HF_TOKEN secret is not set, skipping Hugging Face deploy.")
        return 0

    if not token.startswith("hf_"):
        print("::error::HF_TOKEN does not look like a Hugging Face access token (those start with 'hf_'). "
              "Create one at https://huggingface.co/settings/tokens and update the repository secret.")
        return 1

    api = HfApi(token=token)
    sha = os.environ.get("GIT_SHA", "")[:7] or "local"
    try:
        space = os.environ.get("HF_SPACE", "").strip() or f"{api.whoami()['name']}/wetter_imst"
        api.create_repo(space, repo_type="space", space_sdk="static", exist_ok=True)
        api.upload_folder(
            repo_id=space,
            repo_type="space",
            folder_path=folder,
            commit_message=f"Deploy {sha} from GitHub",
            delete_patterns=STALE_PATTERNS,
        )
    except HfHubHTTPError as error:
        status = error.response.status_code if error.response is not None else "?"
        if status in (401, 403):
            print(f"::error::Hugging Face rejected HF_TOKEN (HTTP {status}). The token is invalid, expired, "
                  "or lacks write access to the Space. Update the repository secret.")
        else:
            print(f"::error::Hugging Face request failed (HTTP {status}): {error}")
        return 1

    print(f"Deployed to https://huggingface.co/spaces/{space}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
