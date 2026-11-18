#!/usr/bin/env python3
"""Patch device login and synchronous session handling in pyhiveapi v1.0.10."""
from pathlib import Path

package = Path(__file__).resolve().parent.parent / 'pylib' / 'pyhiveapi'


def patch_auth():
    path = package / 'api' / 'hive_auth.py'
    content = path.read_text()
    if 'def is_device_registered(' in content:
        return

    marker = '\ndef hex_to_long'
    if marker not in content:
        raise SystemExit(f'patch-pylib: could not find insertion point in {path}')

    method = (
        '\n'
        '    def is_device_registered(self):\n'
        '        """Return True if device credentials are configured for device login."""\n'
        '        return bool(self.device_key) and bool(self.device_group_key)\n'
    )
    path.write_text(content.replace(marker, method + marker, 1))
    print('patch-pylib: added is_device_registered to HiveAuth')


def patch_session():
    path = package / 'session.py'
    content = path.read_text()
    # unasync translates asyncio to threading even for APIs with different
    # synchronous equivalents. The generated session already imports time.
    patched = content.replace('threading.current_task()', 'threading.current_thread()')
    patched = patched.replace('threading.sleep(', 'time.sleep(')
    patched = patched.replace('except threading.TimeoutError:', 'except TimeoutError:')
    if patched != content:
        path.write_text(patched)
        print('patch-pylib: fixed synchronous polling and retry handling')


patch_auth()
patch_session()
