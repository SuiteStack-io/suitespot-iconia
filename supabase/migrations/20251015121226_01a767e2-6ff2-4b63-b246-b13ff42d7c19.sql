-- Update Ahmed Magdy's email address
UPDATE auth.users 
SET email = 'amagdy@suitespotegypt.com',
    raw_user_meta_data = jsonb_set(raw_user_meta_data, '{email}', '"amagdy@suitespotegypt.com"')
WHERE email = 'a.magdy@suitespotegypt.com';