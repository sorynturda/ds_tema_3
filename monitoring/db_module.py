import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_NAME = os.getenv('DB_NAME', 'monitoring_db')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASS = os.getenv('DB_PASS', 'postgres')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')


def get_db_connection():
    """Establishes and returns a new PostgreSQL connection."""
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT
    )


def init_db():
    """Initializes the raw_measurements table."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        create_table_query = """
        CREATE TABLE IF NOT EXISTS raw_measurements (
            id SERIAL PRIMARY KEY,
            device_id UUID NOT NULL,
            user_id UUID NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            consumption_kwh NUMERIC(10, 5) NOT NULL
        );
        """
        cursor.execute(create_table_query)

        conn.commit()
        print("[DB_Module] Database initialized successfully (raw_measurements).")

    except Exception as e:
        print(f"[DB_Module] ERROR: Could not connect or initialize database: {e}")
        raise e
    finally:
        if conn:
            conn.close()


def write_raw_data(device_id, user_id, timestamp_str, consumption):
    """Writes a single raw measurement record to the database."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        insert_query = """
        INSERT INTO raw_measurements (device_id, user_id, timestamp, consumption_kwh)
        VALUES (%s, %s, %s, %s);
        """

        cursor.execute(insert_query, (device_id, user_id, timestamp_str, consumption))
        conn.commit()


    except Exception as e:
        # Critical error; should log and potentially let the RabbitMQ ack fail
        print(f"[DB_Module] CRITICAL ERROR during DB write: {e}")
        raise e
    finally:
        if conn:
            conn.close()