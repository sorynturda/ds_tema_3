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
    """Initializes the raw_measurements, devices, and device_mappings tables."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        create_measurements_table = """
        CREATE TABLE IF NOT EXISTS raw_measurements (
            id SERIAL PRIMARY KEY,
            device_id UUID NOT NULL,
            user_id UUID NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            consumption_kwh NUMERIC(10, 5) NOT NULL
        );
        """
        cursor.execute(create_measurements_table)

        create_devices_table = """
        CREATE TABLE IF NOT EXISTS devices (
            id UUID PRIMARY KEY
        );
        """
        cursor.execute(create_devices_table)

        create_mappings_table = """
        CREATE TABLE IF NOT EXISTS device_mappings (
            device_id UUID PRIMARY KEY,
            user_id UUID NOT NULL
        );
        """
        cursor.execute(create_mappings_table)

        conn.commit()
        print("[DB_Module] Database initialized successfully (raw_measurements, devices, device_mappings).")

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

def insert_device(device_id):
    """Inserts or updates a device record."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        insert_query = """
        INSERT INTO devices (id)
        VALUES (%s)
        ON CONFLICT (id) DO NOTHING;
        """

        cursor.execute(insert_query, (device_id,))
        conn.commit()
        print(f"[DB_Module] Device {device_id} saved.")

    except Exception as e:
        print(f"[DB_Module] ERROR inserting device: {e}")
        raise e
    finally:
        if conn:
            conn.close()

def insert_mapping(device_id, user_id):
    """Inserts or updates a device-user mapping."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        insert_query = """
        INSERT INTO device_mappings (device_id, user_id)
        VALUES (%s, %s)
        ON CONFLICT (device_id) DO UPDATE 
        SET user_id = EXCLUDED.user_id;
        """

        cursor.execute(insert_query, (device_id, user_id))
        conn.commit()
        print(f"[DB_Module] Mapping saved: Device {device_id} -> User {user_id}")

    except Exception as e:
        print(f"[DB_Module] ERROR inserting mapping: {e}")
        raise e
    finally:
        if conn:
            conn.close()

def delete_mapping(device_id):
    """Deletes a device-user mapping."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        delete_query = "DELETE FROM device_mappings WHERE device_id = %s;"
        cursor.execute(delete_query, (device_id,))
        conn.commit()
        print(f"[DB_Module] Mapping deleted for Device {device_id}")

    except Exception as e:
        print(f"[DB_Module] ERROR deleting mapping: {e}")
        raise e
    finally:
        if conn:
            conn.close()

def delete_device(device_id):
    """Deletes a device record."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        delete_query = "DELETE FROM devices WHERE id = %s;"
        cursor.execute(delete_query, (device_id,))
        conn.commit()
        print(f"[DB_Module] Device {device_id} deleted.")

    except Exception as e:
        print(f"[DB_Module] ERROR deleting device: {e}")
        raise e
    finally:
        if conn:
            conn.close()

def check_mapping(device_id, user_id):
    """Checks if a device is mapped to the given user."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = "SELECT 1 FROM device_mappings WHERE device_id = %s AND user_id = %s;"
        cursor.execute(query, (device_id, user_id))
        result = cursor.fetchone()
        
        return result is not None

    except Exception as e:
        print(f"[DB_Module] ERROR checking mapping: {e}")
        return False
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