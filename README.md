# CineMantra

A dark, Netflix-style cinema discovery web app built with Python, Flask, HTML5, CSS3, and Vanilla JavaScript.

## Setup

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Visit `http://127.0.0.1:5000`

## Project Structure

```
CineMantra/
├── app.py              # Flask app factory
├── config.py           # Configuration
├── requirements.txt
├── .env                # Environment variables
├── routes/
│   ├── home.py         # Home blueprint
│   └── api.py          # API blueprint
├── services/           # Business logic (future)
├── database/           # DB models/queries (future)
├── templates/
│   ├── base.html       # Reusable layout
│   └── index.html      # Homepage
└── static/
    ├── css/
    └── js/
```
