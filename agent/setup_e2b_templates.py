from e2b import Template
import os
from dotenv import load_dotenv

load_dotenv()

# script that runs once. creates templates in e2b, used to define custom sandboxes
def setup_e2b_templates():
    # print("Building python-base...")
    # py_template = Template().from_python_image("3.13")
    # Template.build(py_template, alias="python-base")  

    # print("Building node-base...")
    # node_template = Template().from_node_image("lts")
    # Template.build(node_template, alias="node-base")

    # print("Building node-python-base (Hybrid)...")
    # hybrid = Template().from_ubuntu_image("22.04").run_cmd("apt-get update && apt-get install -y python3 python3-pip nodejs npm")
    # Template.build(hybrid, alias="node-python-base")
        
    hybrid = (
        Template()
        .from_node_image("lts")
        .apt_install(["python3", "python3-pip", "python3-venv"])
    )
    
    Template.build(hybrid, alias="node-python-base")
    
    print("Done!")

if __name__ == "__main__":
    setup_e2b_templates()