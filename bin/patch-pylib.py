#!/usr/bin/env python3
"""Add is_device_registered to HiveAuth if missing.

pyhiveapi v1.0.10 has a packaging bug: the unasync build step generates the
sync pyhiveapi package from the async apyhiveapi source, but omits the
is_device_registered method from HiveAuth. This script adds a minimal
implementation that checks whether device credentials are configured,
which is all that is needed for the initial device login flow.

This script is idempotent and can be safely removed once the upstream
library ships a release that includes the fix.
"""
import os
import sys

auth_path = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'pylib', 'pyhiveapi', 'api', 'hive_auth.py')
)

with open(auth_path) as f:
    content = f.read()

if 'is_device_registered' in content:
    print('patch-pylib: is_device_registered already present, nothing to do')
    sys.exit(0)

patch = (
    '\n'
    '    def is_device_registered(self):\n'
    '        """Return True if device credentials are configured for device login."""\n'
    '        return bool(self.device_key) and bool(self.device_group_key)\n'
)

marker = '\ndef hex_to_long'
if marker not in content:
    print(f'patch-pylib: ERROR - could not find insertion point in {auth_path}', file=sys.stderr)
    sys.exit(1)

content = content.replace(marker, patch + marker, 1)

with open(auth_path, 'w') as f:
    f.write(content)

print('patch-pylib: added is_device_registered to HiveAuth')
