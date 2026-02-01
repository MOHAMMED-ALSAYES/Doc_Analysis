from pydantic import BaseModel, Field
from typing import Optional


class UserPermissions(BaseModel):
    view_all_documents: bool = False
    manage_own_documents: bool = True
    delete_own_documents: bool = False
    share_own_documents: bool = False
    search_own_documents: bool = True


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role_name: str = Field(description="system_admin or employee")
    analyze_scope: str = Field(default="own")  # own|all|selected
    must_change_password: bool = True
    permissions: Optional[UserPermissions] = None


class UserRead(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role_name: str
    is_active: bool
    must_change_password: bool
    analyze_scope: Optional[str] = None
    permissions: Optional[dict] = None
    online: Optional[bool] = None  # حالة الاتصال

    class Config:
        from_attributes = True



