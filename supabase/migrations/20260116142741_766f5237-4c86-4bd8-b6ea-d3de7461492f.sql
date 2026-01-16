-- Add access_cards_given column to track how many access cards were given to guests at check-in
ALTER TABLE reservations 
ADD COLUMN access_cards_given integer DEFAULT NULL;