# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Pipeline UI Base & Registry

Defines the PipelineUI protocol and the registration mechanism.
"""

from typing import Dict, Any, List, Type

class PipelineUI:
    """
    Base class for Pipeline UI plugins.
    
    Each pipeline should implement a subclass to define its own full-page UI.
    """
    name: str = "base"
    display_name: str = "Base Pipeline"
    icon: str = "🔌"
    description: str = ""
    
    def render(self, pixelle_video: Any):
        """
        Render the full page content for this pipeline (below settings).
        
        Args:
            pixelle_video: The initialized PixelleVideoCore instance.
        """
        raise NotImplementedError


# ==================== Registry ====================

_pipeline_uis: Dict[str, PipelineUI] = {}

def register_pipeline_ui(ui_class: Type[PipelineUI]):
    """Register a pipeline UI class"""
    instance = ui_class()
    _pipeline_uis[instance.name] = instance

def get_all_pipeline_uis() -> List[PipelineUI]:
    """Get all registered pipeline UI instances"""
    return list(_pipeline_uis.values())
