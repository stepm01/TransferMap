"""
Database Models for UC Transfer Verifier
Using SQLAlchemy ORM
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    """User model for storing student information"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    major = Column(String, nullable=False)
    community_college = Column(String, nullable=False)
    target_uc = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    transcript_courses = relationship("TranscriptCourse", back_populates="user")
    verification_results = relationship("VerificationResult", back_populates="user")


class TranscriptCourse(Base):
    """Model for storing individual transcript courses"""
    __tablename__ = "transcript_courses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_code = Column(String, nullable=False)
    course_name = Column(String, nullable=False)
    units = Column(Float, nullable=False)
    grade = Column(String, nullable=False)
    semester = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    user = relationship("User", back_populates="transcript_courses")


class VerificationResult(Base):
    """Model for storing verification results"""
    __tablename__ = "verification_results"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    eligibility_status = Column(String, nullable=False)
    eligibility_message = Column(String, nullable=False)
    summary_data = Column(JSON, nullable=False)
    major_requirements = Column(JSON, nullable=False)
    igetc_status = Column(JSON, nullable=False)
    risks = Column(JSON, nullable=False)
    sources = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    user = relationship("User", back_populates="verification_results")


class CourseEquivalency(Base):
    """Model for caching Assist.org course equivalencies"""
    __tablename__ = "course_equivalencies"
    
    id = Column(Integer, primary_key=True, index=True)
    community_college = Column(String, nullable=False, index=True)
    cc_course_code = Column(String, nullable=False)
    cc_course_name = Column(String, nullable=True)
    uc_campus = Column(String, nullable=False)
    uc_course_code = Column(String, nullable=False)
    uc_course_name = Column(String, nullable=True)
    units = Column(Float, nullable=False)
    igetc_areas = Column(JSON, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)
    source_url = Column(String, nullable=True)


class UCRequirement(Base):
    """Model for storing UC transfer requirements by major"""
    __tablename__ = "uc_requirements"
    
    id = Column(Integer, primary_key=True, index=True)
    uc_campus = Column(String, nullable=False, index=True)
    major = Column(String, nullable=False, index=True)
    requirement_type = Column(String, nullable=False)  # 'major_prep', 'igetc', 'gpa', 'units'
    requirement_data = Column(JSON, nullable=False)
    notes = Column(JSON, nullable=True)
    source_url = Column(String, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)
