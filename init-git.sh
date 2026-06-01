#!/usr/bin/env bash
# Lokales Git-Repo initialisieren (auf deinem Rechner ausführen).
set -e
git init
git add -A
git commit -m "Initial scaffold: Next.js + Supabase + GoCardless finance dashboard"
echo "Fertig. Optional: 'git remote add origin <URL>' und 'git push -u origin main'."
