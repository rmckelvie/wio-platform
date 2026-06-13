-- Add a "Cooldown" category to the section_type enum so coaches can
-- tag exercises that belong in the end-of-session cooldown block.
-- Placed after conditioning so it sorts to the end of the list, which
-- matches its position in a session.

alter type section_type add value if not exists 'cooldown';
