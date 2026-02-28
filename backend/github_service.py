import httpx
import base64
import os

async def create_github_repo(token: str, repo_name: str):
    async with httpx.AsyncClient() as client:
        # Create repo
        res = await client.post(
            "https://api.github.com/user/repos",
            headers={"Authorization": f"token {token}"},
            json={"name": repo_name, "private": True}
        )
        return res.json()

async def push_to_github(token: str, username: str, repo_name: str, folder_path: str):
    async with httpx.AsyncClient() as client:
        for root, _, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, folder_path).replace("\\", "/")
                
                with open(file_path, "rb") as f:
                    content = base64.b64encode(f.read()).decode()

                # Push each file
                await client.put(
                    f"https://api.github.com/repos/{username}/{repo_name}/contents/{rel_path}",
                    headers={"Authorization": f"token {token}"},
                    json={
                        "message": f"Syncing {rel_path} from Lock-In AI",
                        "content": content
                    }
                )

async def sync_to_github(token: str, repo_name: str, folder_path: str):
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    async with httpx.AsyncClient() as client:
        # Get GitHub username
        user_res = await client.get("https://api.github.com/user", headers=headers)
        user_res.raise_for_status()
        username = user_res.json()["login"]

        # Create or verify the private repository
        repo_data = {"name": repo_name, "private": True}
        repo_res = await client.post("https://api.github.com/user/repos", headers=headers, json=repo_data)
        
        # 422 means repo already exists; we continue to push updates
        if repo_res.status_code not in [201, 422]:
            repo_res.raise_for_status()

        # Recursively upload files
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                # Ensure we get the path relative to the 'code' folder
                rel_path = os.path.relpath(file_path, folder_path).replace("\\", "/")
                
                with open(file_path, "rb") as f:
                    content = base64.b64encode(f.read()).decode("utf-8")

                # Put file into the repository
                await client.put(
                    f"https://api.github.com/repos/{username}/{repo_name}/contents/{rel_path}",
                    headers=headers,
                    json={
                        "message": f"Pushing {rel_path} via Lock-In Sync",
                        "content": content
                    }
                )
        return f"https://github.com/{username}/{repo_name}"