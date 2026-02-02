"""
Eligibility Service
Core logic for checking transfer eligibility against requirements
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class CourseMatch:
    """Represents a matched course requirement"""
    requirement_name: str
    completed: bool
    matched_course: Optional[str] = None
    acceptable_courses: List[str] = None


@dataclass
class RiskItem:
    """Represents a risk or warning"""
    type: str
    severity: str  # 'high', 'medium', 'low'
    message: str
    source: str


class EligibilityChecker:
    """
    Service class for checking transfer eligibility
    """
    
    GRADE_POINTS = {
        "A+": 4.0, "A": 4.0, "A-": 3.7,
        "B+": 3.3, "B": 3.0, "B-": 2.7,
        "C+": 2.3, "C": 2.0, "C-": 1.7,
        "D+": 1.3, "D": 1.0, "D-": 0.7,
        "F": 0.0
    }
    
    def __init__(self, requirements: Dict, equivalencies: Dict):
        self.requirements = requirements
        self.equivalencies = equivalencies
    
    def calculate_gpa(self, courses: List[Dict]) -> float:
        """Calculate GPA from transcript courses"""
        total_points = 0.0
        total_units = 0.0
        
        for course in courses:
            grade = course.get("grade", "").upper()
            units = float(course.get("units", 0))
            
            if grade in self.GRADE_POINTS:
                total_points += self.GRADE_POINTS[grade] * units
                total_units += units
        
        return round(total_points / total_units, 2) if total_units > 0 else 0.0
    
    def calculate_total_units(self, courses: List[Dict]) -> float:
        """Calculate total units from transcript"""
        return sum(float(c.get("units", 0)) for c in courses)
    
    def check_major_requirements(
        self, 
        courses: List[Dict], 
        major: str
    ) -> Dict[str, List[CourseMatch]]:
        """
        Check major preparation requirements
        Returns dict with 'completed' and 'missing' lists
        """
        if major not in self.requirements:
            return {"completed": [], "missing": []}
        
        major_reqs = self.requirements[major].get("required_courses", [])
        completed_codes = [c.get("course_code", "").upper() for c in courses]
        
        completed = []
        missing = []
        
        for req in major_reqs:
            match = CourseMatch(
                requirement_name=req["name"],
                completed=False,
                matched_course=None,
                acceptable_courses=req.get("equivalent_codes", [])
            )
            
            for code in req.get("equivalent_codes", []):
                if code.upper() in completed_codes:
                    match.completed = True
                    match.matched_course = code
                    break
            
            if match.completed:
                completed.append(match)
            else:
                missing.append(match)
        
        return {"completed": completed, "missing": missing}
    
    def check_igetc_areas(
        self, 
        courses: List[Dict], 
        college: str,
        major: str
    ) -> Dict[str, Dict]:
        """
        Check IGETC general education areas
        Returns dict mapping area codes to completion status
        """
        if major not in self.requirements:
            return {}
        
        igetc_reqs = self.requirements[major].get("igetc_areas", {})
        college_equiv = self.equivalencies.get(college, {})
        
        # Find which IGETC areas are satisfied by completed courses
        satisfied_areas = set()
        completed_codes = [c.get("course_code", "").upper() for c in courses]
        
        for code in completed_codes:
            if code in college_equiv:
                areas = college_equiv[code].get("igetc", [])
                satisfied_areas.update(areas)
        
        # Build status for each required area
        result = {}
        for area_code, area_info in igetc_reqs.items():
            result[area_code] = {
                "name": area_info.get("name", ""),
                "required": area_info.get("required", True),
                "completed": area_code in satisfied_areas
            }
        
        return result
    
    def identify_risks(
        self,
        gpa: float,
        total_units: float,
        major_status: Dict,
        igetc_status: Dict,
        major: str
    ) -> List[RiskItem]:
        """
        Identify risks and warnings for the transfer application
        """
        if major not in self.requirements:
            return []
        
        reqs = self.requirements[major]
        risks = []
        
        # GPA risks
        min_gpa = reqs.get("min_gpa", 2.5)
        if gpa < min_gpa:
            risks.append(RiskItem(
                type="GPA",
                severity="high",
                message=f"GPA ({gpa}) is below minimum requirement ({min_gpa})",
                source=reqs.get("source_url", "")
            ))
        elif gpa < min_gpa + 0.3:
            risks.append(RiskItem(
                type="GPA",
                severity="medium",
                message=f"GPA ({gpa}) meets minimum but may not be competitive",
                source=reqs.get("source_url", "")
            ))
        
        # Unit risks
        min_units = reqs.get("min_units", 60)
        max_units = reqs.get("max_units", 90)
        
        if total_units < min_units:
            risks.append(RiskItem(
                type="Units",
                severity="high",
                message=f"Need {min_units} units minimum, have {total_units}",
                source=reqs.get("source_url", "")
            ))
        elif total_units > max_units:
            risks.append(RiskItem(
                type="Units",
                severity="medium",
                message=f"Unit count ({total_units}) exceeds {max_units} cap",
                source=reqs.get("source_url", "")
            ))
        
        # Missing major prep
        missing_count = len(major_status.get("missing", []))
        if missing_count > 0:
            risks.append(RiskItem(
                type="Major Prep",
                severity="high",
                message=f"Missing {missing_count} required major prep course(s)",
                source="https://assist.org"
            ))
        
        # Missing IGETC
        missing_igetc = [
            code for code, info in igetc_status.items()
            if info.get("required") and not info.get("completed")
        ]
        if missing_igetc:
            risks.append(RiskItem(
                type="IGETC",
                severity="medium",
                message=f"IGETC areas incomplete: {', '.join(missing_igetc)}",
                source="https://assist.org/transfer/igetc"
            ))
        
        return risks
    
    def determine_eligibility(
        self,
        gpa: float,
        total_units: float,
        major_status: Dict,
        major: str
    ) -> tuple[str, str]:
        """
        Determine overall eligibility status
        Returns (status, message)
        """
        if major not in self.requirements:
            return ("unknown", "Major requirements not found")
        
        reqs = self.requirements[major]
        
        gpa_ok = gpa >= reqs.get("min_gpa", 2.5)
        units_ok = (
            reqs.get("min_units", 60) <= total_units <= reqs.get("max_units", 90)
        )
        major_prep_ok = len(major_status.get("missing", [])) == 0
        
        if gpa_ok and units_ok and major_prep_ok:
            return (
                "likely_eligible",
                "You appear to meet the basic transfer requirements. "
                "Verify with an advisor before applying."
            )
        elif gpa_ok and units_ok:
            return (
                "conditional",
                "You meet GPA and unit requirements but are missing coursework. "
                "Complete missing courses before applying."
            )
        else:
            return (
                "not_yet_eligible",
                "You do not yet meet transfer requirements. "
                "Review the issues below and work with an advisor."
            )
    
    def run_full_verification(
        self,
        courses: List[Dict],
        college: str,
        major: str,
        target_uc: str = "UCSC"
    ) -> Dict[str, Any]:
        """
        Run complete eligibility verification
        Returns full verification result
        """
        gpa = self.calculate_gpa(courses)
        total_units = self.calculate_total_units(courses)
        major_status = self.check_major_requirements(courses, major)
        igetc_status = self.check_igetc_areas(courses, college, major)
        risks = self.identify_risks(
            gpa, total_units, major_status, igetc_status, major
        )
        eligibility_status, eligibility_message = self.determine_eligibility(
            gpa, total_units, major_status, major
        )
        
        reqs = self.requirements.get(major, {})
        
        return {
            "eligibility_status": eligibility_status,
            "eligibility_message": eligibility_message,
            "summary": {
                "total_units": total_units,
                "gpa": gpa,
                "min_gpa_required": reqs.get("min_gpa", 2.5),
                "units_range": f"{reqs.get('min_units', 60)}-{reqs.get('max_units', 90)}",
                "major": major,
                "target_uc": target_uc,
            },
            "major_requirements": {
                "completed": [
                    {
                        "requirement": m.requirement_name,
                        "matched_course": m.matched_course,
                    }
                    for m in major_status["completed"]
                ],
                "missing": [
                    {
                        "requirement": m.requirement_name,
                        "acceptable_courses": m.acceptable_courses,
                    }
                    for m in major_status["missing"]
                ],
            },
            "igetc_status": igetc_status,
            "risks": [
                {
                    "type": r.type,
                    "severity": r.severity,
                    "message": r.message,
                    "source": r.source,
                }
                for r in risks
            ],
            "notes": reqs.get("notes", []),
            "sources": {
                "ucsc_transfer": reqs.get("source_url", ""),
                "assist_org": "https://assist.org",
            },
            "disclaimer": (
                "This is a verification tool using official sources. "
                "It is NOT official advice. Always confirm with an academic counselor."
            )
        }
