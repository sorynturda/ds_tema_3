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
        print(f"[DB_Module] CRITICAL ERROR during DB write: {e}")
        raise e
    finally:
        if conn:
            conn.close()


def get_daily_consumption(device_id, date_str):
    """
    Retrieves hourly aggregated consumption for a specific device and date.
    Returns a list of dictionaries: [{'hour': 0, 'value': 1.5}, ...]
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        SELECT EXTRACT(HOUR FROM timestamp) as hour, SUM(consumption_kwh) as total
        FROM raw_measurements
        WHERE device_id = %s AND DATE(timestamp) = %s
        GROUP BY hour
        ORDER BY hour;
        """

        cursor.execute(query, (device_id, date_str))
        rows = cursor.fetchall()
        
        print(f"[DB_Module] Query for {device_id} on {date_str} returned {len(rows)} rows.")
        if rows:
            print(f"[DB_Module] Sample row: {rows[0]}")

        result = []
        for row in rows:
            result.append({
                "hour": int(row[0]),
                "value": float(row[1])
            })
        
        return result

    except Exception as e:
        print(f"[DB_Module] ERROR fetching daily consumption: {e}")
        return []
    finally:
        if conn:
            conn.close()