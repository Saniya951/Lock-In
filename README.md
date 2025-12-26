# Lock-In

<!-- frontend -->
cd frontend
# This sets up the React blueprint inside your existing folder
npm create vite@latest . -- --template react

# Install Tailwind CSS and its dependencies
# npm install -D tailwindcss postcss autoprefixer [DO NOT USE THIS USE BELOW]
npm install @tailwindcss/postcss

# Install icons for the project
npm install lucide-react

# Create the config files
npx tailwindcss init -p