@echo off
echo Cleaning up all existing localhost processes...
npx kill-port 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010

echo Starting fresh dev server on port 3003...
set PORT=3003
npm run dev