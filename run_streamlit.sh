#!/bin/bash
cd /workspaces/mjmapp
source myent/bin/activate
streamlit run app.py --server.enableCORS false --server.enableXsrfProtection false
