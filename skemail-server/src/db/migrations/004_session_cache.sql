-- Key the browser uses to encrypt its local session cache, so a page reload can restore the login.
-- It never leaves the server except to the holder of the matching session cookie.
ALTER TABLE sessions ADD COLUMN cache_key TEXT;
