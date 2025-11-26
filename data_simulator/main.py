import pika, pika.exceptions
import json
import time
import threading
import random
import datetime
import math
import os
from dotenv import load_dotenv
import tkinter as tk
from tkinter import ttk, scrolledtext

load_dotenv()
RABBITMQ_HOST = 'localhost'
RABBITMQ_USER = os.getenv('RABBITMQ_USER')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS')

DATA_EXCHANGE = 'data_collection_exchange'
DATA_ROUTING_KEY = 'device.measurement'

BASE_LOAD_MIN = 0.5
BASE_LOAD_MAX = 1.5
AMPLITUDE = 1.0
PHASE_SHIFT = 18
NOISE_PERCENTAGE = 0.05


CREDENTIALS = pika.credentials.PlainCredentials(username=RABBITMQ_USER, password=RABBITMQ_PASS)

CONN_PARAMS = pika.ConnectionParameters(
    host=RABBITMQ_HOST,
    port=5672,
    credentials=CREDENTIALS
)

class SimulatorApp:
    def __init__(self, master):
        self.master = master
        master.title("Device Data Simulator")

        self.selected_device_id = tk.StringVar(master)
        self.selected_user_id = tk.StringVar(master)
        self.simulation_interval_sec = 600
        self.is_running = False
        self.simulation_thread = None

        self.base_load = random.uniform(BASE_LOAD_MIN, BASE_LOAD_MAX)

        self.create_widgets()

    def create_widgets(self):
        device_frame = ttk.LabelFrame(self.master, text="1. Device Configuration", padding="10")
        device_frame.grid(row=0, column=0, padx=10, pady=5, sticky="ew")

        ttk.Label(device_frame, text="Device ID (UUID):").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.device_entry = ttk.Entry(device_frame, textvariable=self.selected_device_id, width=40)
        self.device_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")

        ttk.Label(device_frame, text="User ID (UUID):").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.user_entry = ttk.Entry(device_frame, textvariable=self.selected_user_id, width=40)
        self.user_entry.grid(row=1, column=1, padx=5, pady=5, sticky="ew")

        self.config_frame = ttk.LabelFrame(self.master, text="2. Simulation Configuration", padding="10")
        self.config_frame.grid(row=1, column=0, padx=10, pady=5, sticky="ew")

        ttk.Label(self.config_frame, text="Interval:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.interval_entry = ttk.Entry(self.config_frame, width=5)
        self.interval_entry.insert(0, "10")
        self.interval_entry.grid(row=0, column=1, padx=5, pady=5, sticky="w")

        self.interval_unit = tk.StringVar(self.master)
        self.interval_unit.set("Minutes")
        self.unit_dropdown = ttk.Combobox(self.config_frame, textvariable=self.interval_unit, values=["Seconds", "Minutes"], state="readonly", width=8)
        self.unit_dropdown.grid(row=0, column=2, padx=5, pady=5, sticky="w")

        self.control_frame = ttk.LabelFrame(self.master, text="3. Control", padding="10")
        self.control_frame.grid(row=2, column=0, padx=10, pady=5, sticky="ew")

        self.start_button = ttk.Button(self.control_frame, text="START Simulation", command=self.start_simulation)
        self.start_button.grid(row=0, column=0, padx=5, pady=5, sticky="w")

        self.stop_button = ttk.Button(self.control_frame, text="STOP Simulation", command=self.stop_simulation, state=tk.DISABLED)
        self.stop_button.grid(row=0, column=1, padx=5, pady=5, sticky="w")

        log_frame = ttk.LabelFrame(self.master, text="4. Simulation Log", padding="10")
        log_frame.grid(row=3, column=0, padx=10, pady=5, sticky="ew")

        self.log_text = scrolledtext.ScrolledText(log_frame, width=60, height=10, state='disabled')
        self.log_text.pack(fill="both", expand=True)

    def log(self, message):
        def _log():
            self.log_text.configure(state='normal')
            self.log_text.insert(tk.END, f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {message}\n")
            self.log_text.see(tk.END)
            self.log_text.configure(state='disabled')
        self.master.after(0, _log)

    def generate_measurement(self, current_time):
        t_hour = current_time.hour + current_time.minute / 60.0

        C_sin = AMPLITUDE * math.sin((2 * math.pi / 24) * (t_hour - PHASE_SHIFT))

        noise = self.base_load * NOISE_PERCENTAGE * random.uniform(-1, 1)

        C = self.base_load + C_sin + noise

        C = max(0, C)

        interval_in_hours = 10.0 / 60.0

        E = C * interval_in_hours

        return E


    def simulation_loop(self, device_id, user_id):
        print(f"[DEBUG] Thread started for Device: {device_id}, User: {user_id}")
        self.log(f"--- Simulation STARTING for Device ID: {device_id} (User: {user_id}) ---")

        try:
            connection = pika.BlockingConnection(CONN_PARAMS)
            channel = connection.channel()

            channel.exchange_declare(exchange=DATA_EXCHANGE, exchange_type='direct', durable=True)
            print("[DEBUG] Connected to RabbitMQ")

        except pika.exceptions.AMQPConnectionError as e:
            print(f"[DEBUG] Connection failed: {e}")
            self.log(f"[!!!] Failed to connect to Data Broker. Simulation aborted.")
            self.is_running = False
            self.master.after(0, self.stop_simulation_gui_update)
            return

        simulated_time = datetime.datetime.now()

        while self.is_running:
            try:
                measurement_value = self.generate_measurement(simulated_time)
                timestamp_str = simulated_time.strftime('%Y-%m-%d %H:%M:%S')

                message_body = {
                    "timestamp": timestamp_str,
                    "device_id": device_id,
                    "user_id": user_id,
                    "measurement_value": round(measurement_value, 5)
                }
                message_json = json.dumps(message_body)

                channel.basic_publish(
                    exchange=DATA_EXCHANGE,
                    routing_key=DATA_ROUTING_KEY,
                    body=message_json,
                    properties=pika.BasicProperties(
                        delivery_mode=2,
                    )
                )

                log_msg = f"SENT: {timestamp_str} | Energy: {message_body['measurement_value']:.4f} kWh"
                print(f"[DEBUG] {log_msg}")
                self.log(log_msg)

                simulated_time += datetime.timedelta(minutes=10)

            except Exception as e:
                print(f"[DEBUG] Error: {e}")
                self.log(f"[!!!] Error during publishing: {e}")

            time.sleep(self.simulation_interval_sec)

        print("[DEBUG] Simulation thread stopping")
        self.log("--- Simulation STOPPED. Closing RabbitMQ connection. ---")
        connection.close()
        self.master.after(0, self.stop_simulation_gui_update)

    def start_simulation(self):
        device_id = self.selected_device_id.get().strip()
        user_id = self.selected_user_id.get().strip()

        print(f"[DEBUG] Start button clicked. Device: '{device_id}', User: '{user_id}'")

        if not device_id or not user_id:
            self.log("[!] Error: Device ID and User ID are required.")
            return

        try:
            interval_value = float(self.interval_entry.get())
            unit = self.interval_unit.get()

            if unit == "Minutes":
                self.simulation_interval_sec = interval_value * 60
            else:
                self.simulation_interval_sec = interval_value

            if self.simulation_interval_sec <= 0:
                 raise ValueError("Interval must be positive.")

        except ValueError as e:
            self.log(f"[!] Invalid Interval value: {e}. Please enter a positive number.")
            return

        if not self.is_running:
            self.is_running = True
            self.simulation_thread = threading.Thread(target=self.simulation_loop, args=(device_id, user_id))
            self.simulation_thread.start()

            self.start_button.config(state=tk.DISABLED)
            self.stop_button.config(state=tk.NORMAL)
            self.device_entry.config(state=tk.DISABLED)
            self.user_entry.config(state=tk.DISABLED)
            self.config_frame.config()

    def stop_simulation(self):
        if self.is_running:
            self.is_running = False

    def stop_simulation_gui_update(self):
        self.start_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
        self.device_entry.config(state=tk.NORMAL)
        self.user_entry.config(state=tk.NORMAL)
        self.config_frame.config()
        self.simulation_thread = None

    def on_closing(self):
        self.stop_simulation()
        if self.simulation_thread and self.simulation_thread.is_alive():
            self.simulation_thread.join(timeout=1)
        self.master.destroy()

if __name__ == '__main__':
    root = tk.Tk()
    app = SimulatorApp(root)

    root.protocol("WM_DELETE_WINDOW", app.on_closing)

    root.mainloop()