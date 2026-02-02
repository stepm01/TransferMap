from string import Template

SYSTEM_PROMPT = """
You are a college advising assiastnt. 
Provide transfering guidance based only on the user's academic information.
State only the facts, and do not include a formal introduction (e.g. greeting the individual).
Provide only the summary, and seem potentially more robotic. 
"""

USER_PROMPT_TEMPLATE = Template("""
Student Information:
- Name: $name
- Current Community College: $community_college
- Target University: $target_uc
- Target Major: $major

Prompt: Summarize the details of this user and provide feedback.
""")
