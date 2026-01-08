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
Pipeline UI Package

Exports registry functions and automatically registers available pipelines.
"""

from web.pipelines.base import (
    PipelineUI,
    register_pipeline_ui,
    get_pipeline_ui,
    get_all_pipeline_uis
)

# Import all pipeline UI modules to ensure they register themselves
from web.pipelines import standard
from web.pipelines import asset_based
from web.pipelines import sora

__all__ = [
    "PipelineUI",
    "register_pipeline_ui",
    "get_pipeline_ui",
    "get_all_pipeline_uis"
]
