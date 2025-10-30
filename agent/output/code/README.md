# Personal Portfolio Website

A full‑stack personal portfolio built with **Flask** (backend), **React** (frontend) and **MongoDB** for data persistence.

## Project Structure
```
project-root/
├─ backend/          # Flask API
│   ├─ config.py
│   ├─ requirements.txt
│   └─ run.py
├─ frontend/         # React SPA (generated with create‑react‑app or Vite)
│   └─ ...
├─ .gitignore
└─ README.md
```

## Getting Started
### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # on Windows use .venv\Scripts\activate
pip install -r requirements.txt
flask --app run --debug   # runs the development server
```

### Frontend
```bash
cd frontend
# If the React scaffold is not yet created, run:
# npx create-react-app .
# or, with Vite:
# npm create vite@latest . -- --template react
npm install
npm start
```

## Configuration
Create a `.env` file in the *backend* directory (it is ignored by Git) with at least the following variables:
```
FLASK_SECRET_KEY=your‑secret‑key
MONGODB_URI=mongodb://localhost:27017/portfolio
```
The `config.py` module loads these values.

## License
MIT License
