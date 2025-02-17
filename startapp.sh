#!/bin/bash
source myent/bin/activate
streamlit run app.py --server.enableXsrfProtection false
