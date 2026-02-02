from prompting.prompts import USER_PROMPT_TEMPLATE

def build_user_prompt(user_data: dict) -> str:
    """
    user_data: dictionary with keys: name, community_college, target_uc, major
    """
    # Ensure all required fields exist
    for key in ["name", "community_college", "target_uc", "major"]:
        user_data.setdefault(key, "N/A")

    return USER_PROMPT_TEMPLATE.substitute(**user_data)
