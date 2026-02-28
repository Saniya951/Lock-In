# Lock-In

A multi-agent system designed to plan, research, and architect software projects based on a single user prompt.

---

## 🚀 Getting Started

These instructions will guide you through setting up and running the project locally. The setup involves creating a virtual environment, installing dependencies, and initializing the local vector database.

### 1. Initial Setup

1.  **Clone the repository:**

    ```bash
    git clone [URL_TO_YOUR_REPOSITORY]
    cd lockin
    ```

2.  **Create a virtual environment:**
    This creates an isolated environment in a folder named `venv` to manage project-specific packages.

    ```bash
    python -m venv venv
    ```

3.  **Activate the virtual environment:**
    You must activate the environment every time you work on the project.

    - **On Windows (Command Prompt / PowerShell):**
      ```bash
      .\venv\Scripts\activate
      ```
    - **On macOS / Linux (Bash / Zsh):**

    ```bash
    source venv/bin/activate
    ```

    _(Your command prompt should now be prefixed with `(venv)`.)_

4.  **Install required packages:**
    This command reads the `requirements.txt` file and installs all the necessary libraries into your `venv`.
    ```bash
    pip install -r requirements.txt
    ```

### 2. Project Configuration

All core logic, scripts, and data live inside the `agent/` directory.

1.  **Set up Environment Variables:**

    Create a file named `.env` **inside the `Lock-in` directory** and add your Groq API and Tavilly API key:

    ```ini
    GROQ_API_KEY=your_api_key_here
    ```

    ```ini
    TAVILY_API_KEY=your_tavily_api_key_here
    ```

2.  **Initialize the Vector Database:**
    Run the setup script to populate the local Chroma vector database. This script will create an `agent/chroma_db/` directory (which is git-ignored) and fill it with data.

    ```bash
    cd agent
    ```

    ```bash
    python setup_vectordb.py
    ```

    or

    ```bash
    python3 setup_vectordb.py
    ```

    You only need to do this once, unless your source data changes.

---

## 🏃‍♀️ Running the Agent

After completing the setup, you can run the main agent.

1.  Ensure your virtual environment (`venv`) is still active.
2.  Run the main graph.py script 
```bash
    python -m agent.graph
```
3.  The script will load the vector database and then prompt you to enter your project request.

---

## 🧑‍💻 Development

### Updating `requirements.txt`

If you install a new package (e.g., `pip install langchain-community`), you **must** update the `requirements.txt`.

Run this command **from the root `lockin/` directory** (where `requirements.txt` lives) to save all packages from your `venv`:

```bash
# Make sure you are in the 'lockin/' root directory
pip freeze > requirements.txt
```

## 🖥️ Running the Application

To run the full application, you will need to start both the backend server and the frontend development environment. It is recommended to use two separate terminal windows.

### 1. Start the Backend (API)
Ensure your virtual environment (`venv`) is activated and you have already installed the requirements.

* **Navigate to the root directory:**
    ```bash
    cd backend
    ```

* **Run the main server:**
    ```bash
    python main.py
    ```

---

### 2. Start the Frontend (UI)
Open a **new terminal** window to run the user interface.

* **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

* **Install dependencies:**
    This only needs to be done once or when `package.json` changes.
    ```bash
    npm install
    ```

* **Launch the development server:**
    ```bash
    npm run dev
    ```
    *(The application will usually be available at `http://localhost:5173` or `http://localhost:3000`.)*

---
