#!/bin/bash
cd /workspaces/mjmapp
source venv/bin/activate
streamlit run app.py --server.enableCORS false --server.enableXsrfProtection false
