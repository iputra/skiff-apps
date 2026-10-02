`remote-mx.key` / `remote-mx.crt`: self-signed certificate (CN=localhost, SAN localhost and 127.0.0.1, valid until
2126) that the fake remote mail server in `test/tls-policy.test.ts` presents for STARTTLS. Test-only; never use it
for anything else. Recreate with:

    openssl req -x509 -newkey rsa:2048 -nodes -days 36500 -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -keyout remote-mx.key -out remote-mx.crt
