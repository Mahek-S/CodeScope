# models/types.py
from sqlalchemy.types import TypeDecorator, String
from utils.crypto import encrypt, decrypt

class EncryptedString(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return decrypt(value) if value is not None else None