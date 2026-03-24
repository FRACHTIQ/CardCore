-- Falls 009 noch mit System-User lief: Anker + Konversationen auf seller id = 1 umstellen.
-- Optional ausführen, wenn bereits ein älteres 009 mit vurax-team@system.internal aktiv war.

UPDATE listing SET seller_id = 1 WHERE is_welcome_anchor = TRUE;

UPDATE conversation c
SET seller_id = 1
FROM listing l
WHERE c.listing_id = l.id AND l.is_welcome_anchor = TRUE;

UPDATE message m
SET sender_id = 1
FROM conversation c
JOIN listing l ON l.id = c.listing_id
WHERE m.conversation_id = c.id AND l.is_welcome_anchor = TRUE;
