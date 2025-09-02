@echo off
rem Runs the concal program
rem use PORT and HOSTNAME env variables to change, defaults to 5173 and 0.0.0.0 if no arguments provided

set NODE_ENV=production
set PORT=80009

node server.js