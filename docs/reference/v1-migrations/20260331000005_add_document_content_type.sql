-- Add 'document' to the content_type CHECK constraint on messages table
alter table messages drop constraint if exists messages_content_type_check;
alter table messages add constraint messages_content_type_check
  check (content_type in ('text', 'image', 'file', 'audio', 'system', 'order', 'product', 'document'));

comment on column messages.content_type is 'Type of content: text, image, file, audio, system, order, product, or document';
