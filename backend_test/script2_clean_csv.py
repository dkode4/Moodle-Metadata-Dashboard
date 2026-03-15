import csv
import ipaddress

INPUT_FILE = 'DATA_RAW.csv'
INVALID_ROWS_FILE = 'script1_invalid_rows.txt'
OUTPUT_FILE = 'CLEANED_DATA.csv'

def is_valid_ip(ip):
    if not ip or ip.strip() in ('-', '', 'NULL', 'null'):
        return False
    try:
        ipaddress.ip_address(ip.strip())
        return True
    except ValueError:
        return False

invalid_row_nums = set()
try:
    with open(INVALID_ROWS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.isdigit():
                invalid_row_nums.add(int(line))
except FileNotFoundError:
    print(f"Warning: {INVALID_ROWS_FILE} not found. No rows will be removed.")

unknown_ip_count = 0
with open(INPUT_FILE, newline='', encoding='utf-8') as f_in, open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f_out:
    reader = csv.reader(f_in)
    writer = csv.writer(f_out)
    header_skipped = False
    row_num = 0
    for row in reader:
        row_num += 1
        if not header_skipped:
            writer.writerow(row)  
            header_skipped = True
            continue
        if row_num in invalid_row_nums:
            continue  
        if len(row) > 8:
            ip = row[8]
            if not is_valid_ip(ip):
                row[8] = 'Unknown'
                unknown_ip_count += 1
            else:
                row[8] = ip.strip()
        writer.writerow(row)

print(f"Cleaned CSV {OUTPUT_FILE}. Invalid rows removed IPs normalized.")
print(f"Total 'Unknown' IPs: {unknown_ip_count}")