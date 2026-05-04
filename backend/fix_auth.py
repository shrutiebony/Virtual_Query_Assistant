import re
with open(r'app/api/routes/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''def _system_conn():
    uri = (
        f"postgresql://"
        f"{os.getenv('DB_USER','da_user')}:{os.getenv('DB_PASSWORD','da_pass')}"
        f"@{os.getenv('DB_HOST','127.0.0.1')}:{os.getenv('DB_PORT','5433')}"
        f"/{os.getenv('DB_NAME','da_db')}"
    )'''

new = '''def _system_conn():
    host = os.getenv('DB_HOST', '127.0.0.1')
    port = os.getenv('DB_PORT', '5433')
    user = os.getenv('DB_USER', 'da_user')
    pwd  = os.getenv('DB_PASS') or os.getenv('DB_PASSWORD', 'da_pass')
    name = os.getenv('DB_NAME', 'da_db')
    if host.startswith('/'):
        uri = f'postgresql://{user}:{pwd}@/{name}?host={host}'
    else:
        uri = f'postgresql://{user}:{pwd}@{host}:{port}/{name}' '''

if old in content:
    content = content.replace(old, new)
    with open(r'app/api/routes/auth.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed successfully')
else:
    print('Pattern not found - showing current _system_conn:')
    idx = content.find('def _system_conn')
    print(content[idx:idx+300])
