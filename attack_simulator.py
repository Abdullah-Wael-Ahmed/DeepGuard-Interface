import socket
import threading
import time
import random
import argparse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

print(r"""
 ▒█████▄   ██▀███   ▄████▄   ▒█████   ███▄    █ 
 ▒██  ▀█▄ ▓██ ▒ ██▒▒██▀ ▀█  ▒██▒  ██▒ ██ ▀█   █ 
 ░██   ▓██▒▓██ ░▄█ ▒▒▓█    ▄ ▒██░  ██▒▓██  ▀█ ██▒
  ██   ▒██░▒██▀▀█▄ ▒▓▓▄ ▄██▒▒██   ██░▓██▒  ▐▌██▒
  ██████▒▒░██▓ ▒██▒▒ ▓███▀ ░░ ████▓▒░▒██░   ▓██░
  ░ ▒▓▒ ▒ ░░ ▒▓ ░▒▓░░ ░▒ ▒  ░░ ▒░▒░▒░ ░ ▒░   ▒ ▒ 
  ░ ░▒  ░ ░  ░▒ ░ ▒░  ░  ▒     ░ ▒ ▒░ ░ ░░   ░ ▒░
  ░  ░  ░    ░░   ░ ░          ░ ░ ░ ▒     ░   ░ ░ 
        ░     ░     ░ ░            ░ ░           ░ 
                    ░                            
DeepGuard Anomaly Traffic Simulator
""")

def ddos_flood(target_ip, target_port, duration):
    print(f"[*] Starting DDoS Simulation against {target_ip}:{target_port} for {duration} seconds...")
    print("[*] This will spike 'conn_count' and 'connections_per_sec'")
    
    end_time = time.time() + duration
    requests_sent = 0

    def send_request():
        nonlocal requests_sent
        try:
            # Create rapid TCP connections
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect((target_ip, target_port))
            s.send(b"GET / HTTP/1.1\r\nHost: " + target_ip.encode() + b"\r\n\r\n")
            s.close()
            requests_sent += 1
        except:
            pass

    with ThreadPoolExecutor(max_workers=50) as executor:
        while time.time() < end_time:
            executor.submit(send_request)
            time.sleep(0.01) # 100 requests per thread per second
            
    print(f"[+] DDoS Simulation complete. Total connections attempted: {requests_sent}")


def port_scan(target_ip, start_port, end_port):
    print(f"[*] Starting Port Scan against {target_ip} (Ports {start_port}-{end_port})...")
    print("[*] This will spike 'port_entropy' and distribute connections across port ranges")
    
    open_ports = []
    def scan_port(port):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            result = s.connect_ex((target_ip, port))
            if result == 0:
                open_ports.append(port)
            s.close()
        except:
            pass

    with ThreadPoolExecutor(max_workers=20) as executor:
        for port in range(start_port, end_port + 1):
            executor.submit(scan_port, port)
            
    print(f"[+] Port scan complete. Found {len(open_ports)} open ports.")


def data_exfiltration(target_ip, target_port):
    print(f"[*] Starting Data Exfiltration Simulation to {target_ip}:{target_port}...")
    print("[*] This will spike 'total_bytes_sent', 'avg_bytes_sent', and 'avg_duration'")
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((target_ip, target_port))
        
        # Generate a large 50MB junk payload
        print("[*] Generating 50MB payload...")
        payload = b"X" * (50 * 1024 * 1024) 
        
        print("[*] Transmitting data...")
        s.sendall(payload)
        s.close()
        print("[+] Exfiltration complete!")
    except Exception as e:
        print(f"[-] Failed to connect: {e}. Note: You need a listener (like netcat) open on the target port!")


def normal_traffic(target_ip, duration=30):
    print(f"[*] Simulating NORMAL web browsing traffic to {target_ip} for {duration} seconds...")
    print("[*] This generates low connections/sec and low entropy, which should NOT flag as an anomaly.")
    
    end_time = time.time() + duration
    requests_sent = 0
    ports = [80, 443, 8080]

    while time.time() < end_time:
        port = random.choice(ports)
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect((target_ip, port))
            s.send(b"GET / HTTP/1.1\r\nHost: " + target_ip.encode() + b"\r\n\r\n")
            s.close()
            requests_sent += 1
        except:
            pass
            
        # Sleep a random amount of time (0.5 to 3 seconds) to mimic human browsing speed
        time.sleep(random.uniform(0.5, 3.0))
        
    print(f"[+] Normal traffic simulation complete. Total gentle requests: {requests_sent}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate network anomalies to trigger DeepGuard Zeek Autoencoder")
    parser.add_argument("--target", required=True, help="Target IP address (e.g. your Kali IP)")
    parser.add_argument("--mode", choices=['normal', 'ddos', 'scan', 'exfil', 'all', 'mix'], required=True, help="Type of traffic to simulate")
    
    args = parser.parse_args()
    
    if args.mode in ['normal', 'mix']:
        normal_traffic(args.target, duration=45)
        if args.mode == 'mix':
            print("\n[*] Waiting 15 seconds before launching attack to clearly separate logs...")
            time.sleep(15)
            
    if args.mode in ['ddos', 'all', 'mix']:
        ddos_flood(args.target, 80, duration=30)
        time.sleep(2)
        
    if args.mode in ['scan', 'all']:
        port_scan(args.target, 1, 1000)
        time.sleep(2)
        
    if args.mode in ['exfil', 'all']:
        print("\n[!] For exfiltration to work, please open a listener on your Kali machine in a new terminal:")
        print("    nc -lvnp 4444 > /dev/null")
        input("    Press Enter when the listener is running...")
        data_exfiltration(args.target, 4444)
print("test1111")
