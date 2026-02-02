"""
Explainer Service
Provides clear, simple explanations for verification results
Can be enhanced with AI/LLM integration for natural language explanations
"""

from typing import Dict, List, Any


class ResultExplainer:
    """
    Service to generate human-readable explanations
    of transfer eligibility results
    """
    
    @staticmethod
    def explain_eligibility_status(status: str, summary: Dict) -> str:
        """Generate explanation for overall eligibility status"""
        gpa = summary.get("gpa", 0)
        units = summary.get("total_units", 0)
        min_gpa = summary.get("min_gpa_required", 2.5)
        major = summary.get("major", "your major")
        
        explanations = {
            "likely_eligible": (
                f"Great news! Based on official requirements, you appear to meet "
                f"the basic eligibility criteria to transfer to UC Santa Cruz for {major}. "
                f"Your GPA of {gpa} meets the {min_gpa} minimum, and your {units} units "
                f"are within the acceptable range. However, always verify this assessment "
                f"with an academic counselor before submitting your application."
            ),
            "conditional": (
                f"You're making progress! Your GPA ({gpa}) and unit count ({units}) "
                f"meet the requirements, but you have some missing coursework. "
                f"You'll need to complete the missing courses listed below before "
                f"or while applying. Consider meeting with a counselor to create "
                f"a plan to complete these requirements."
            ),
            "not_yet_eligible": (
                f"Based on the official requirements, you don't yet meet all the "
                f"criteria to transfer. This is common and fixable! Review the "
                f"specific issues below and work with a counselor to create a plan. "
                f"Many students need an extra semester or two to become eligible."
            ),
            "unknown": (
                f"We couldn't determine your eligibility status. This might be because "
                f"the requirements for your major aren't in our demo database. "
                f"Please check assist.org directly or speak with a counselor."
            )
        }
        
        return explanations.get(status, explanations["unknown"])
    
    @staticmethod
    def explain_risk(risk: Dict) -> str:
        """Generate a clear explanation for a specific risk"""
        risk_type = risk.get("type", "")
        severity = risk.get("severity", "")
        message = risk.get("message", "")
        
        severity_prefix = {
            "high": "⚠️ Important: ",
            "medium": "📋 Note: ",
            "low": "ℹ️ FYI: "
        }
        
        prefix = severity_prefix.get(severity, "")
        
        # Add context based on risk type
        context = {
            "GPA": (
                " Your GPA is calculated from the grades on your transcript. "
                "If you have in-progress courses, your final GPA may change."
            ),
            "Units": (
                " Units are semester/quarter hours. Make sure to count all "
                "transferable courses, including in-progress ones."
            ),
            "Major Prep": (
                " Major prep courses must be completed to be competitive. "
                "Check assist.org for your specific college's equivalencies."
            ),
            "IGETC": (
                " IGETC is the general education pattern for UC transfers. "
                "Some majors have partial IGETC exemptions."
            )
        }
        
        return prefix + message + context.get(risk_type, "")
    
    @staticmethod
    def explain_missing_course(requirement: str, acceptable_courses: List[str]) -> str:
        """Explain what courses can fulfill a missing requirement"""
        courses_str = ", ".join(acceptable_courses[:3])
        if len(acceptable_courses) > 3:
            courses_str += f" (and {len(acceptable_courses) - 3} others)"
        
        return (
            f"**{requirement}**: This requirement can be fulfilled by taking "
            f"one of these courses at your community college: {courses_str}. "
            f"Check assist.org to confirm the current articulation."
        )
    
    @staticmethod
    def generate_action_items(verification_result: Dict) -> List[Dict]:
        """Generate prioritized action items based on verification"""
        actions = []
        
        # Check for missing major prep (highest priority)
        missing = verification_result.get("major_requirements", {}).get("missing", [])
        if missing:
            actions.append({
                "priority": 1,
                "action": "Complete missing major prep courses",
                "details": [
                    f"• {m['requirement']}" 
                    for m in missing[:3]
                ],
                "source": "assist.org"
            })
        
        # Check for GPA issues
        risks = verification_result.get("risks", [])
        gpa_risks = [r for r in risks if r.get("type") == "GPA"]
        if gpa_risks:
            actions.append({
                "priority": 2,
                "action": "Improve your GPA",
                "details": [
                    "Focus on getting A's and B's in remaining courses",
                    "Consider retaking courses where you got C's or lower",
                    "The higher your GPA, the more competitive you'll be"
                ],
                "source": verification_result.get("sources", {}).get("ucsc_transfer", "")
            })
        
        # Check for unit issues
        unit_risks = [r for r in risks if r.get("type") == "Units"]
        if unit_risks:
            severity = unit_risks[0].get("severity", "")
            if severity == "high":
                actions.append({
                    "priority": 1,
                    "action": "Earn more transferable units",
                    "details": [
                        "You need at least 60 semester units to transfer",
                        "Make sure all courses are UC-transferable",
                        "Check with a counselor about your current total"
                    ],
                    "source": ""
                })
            else:
                actions.append({
                    "priority": 3,
                    "action": "Watch your unit count",
                    "details": [
                        "You're approaching or over the 90-unit cap",
                        "Extra units may not transfer",
                        "Plan your remaining courses carefully"
                    ],
                    "source": ""
                })
        
        # Always recommend counselor meeting
        actions.append({
            "priority": 4,
            "action": "Meet with an academic counselor",
            "details": [
                "Review this verification with a counselor",
                "Create a personalized education plan",
                "Get official guidance for your situation"
            ],
            "source": ""
        })
        
        # Sort by priority
        actions.sort(key=lambda x: x["priority"])
        
        return actions
    
    @staticmethod
    def generate_summary_paragraph(verification_result: Dict) -> str:
        """Generate a natural language summary paragraph"""
        status = verification_result.get("eligibility_status", "unknown")
        summary = verification_result.get("summary", {})
        risks = verification_result.get("risks", [])
        missing = verification_result.get("major_requirements", {}).get("missing", [])
        
        gpa = summary.get("gpa", 0)
        units = summary.get("total_units", 0)
        major = summary.get("major", "your chosen major")
        
        # Build the paragraph
        parts = []
        
        if status == "likely_eligible":
            parts.append(
                f"Based on the official requirements from assist.org and UCSC, "
                f"you appear to be on track for transferring to UCSC for {major}."
            )
        elif status == "conditional":
            parts.append(
                f"You're making good progress toward transferring to UCSC for {major}, "
                f"but there are some items you'll need to address."
            )
        else:
            parts.append(
                f"You're working toward transferring to UCSC for {major}, "
                f"and there are several items that need attention."
            )
        
        parts.append(
            f"Currently, you have {units} transferable units and a {gpa} GPA."
        )
        
        if missing:
            parts.append(
                f"You still need to complete {len(missing)} major preparation "
                f"course{'s' if len(missing) > 1 else ''}."
            )
        
        high_risks = [r for r in risks if r.get("severity") == "high"]
        if high_risks:
            parts.append(
                f"There {'are' if len(high_risks) > 1 else 'is'} "
                f"{len(high_risks)} important issue{'s' if len(high_risks) > 1 else ''} "
                f"to address before applying."
            )
        
        parts.append(
            "Remember to verify all information with an academic counselor, "
            "as requirements can change and individual situations vary."
        )
        
        return " ".join(parts)
