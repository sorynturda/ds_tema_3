FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY .env db_module.py main.py ./

EXPOSE 8001
EXPOSE 8002
EXOISE 8003

CMD [ "python", "main.py" ]
