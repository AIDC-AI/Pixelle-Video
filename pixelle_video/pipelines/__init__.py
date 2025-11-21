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
Pixelle-Video Pipelines

Video generation pipelines with different strategies and workflows.
Each pipeline implements a specific video generation approach.
"""

from pixelle_video.pipelines.base import BasePipeline
from pixelle_video.pipelines.standard import StandardPipeline

__all__ = [
    "BasePipeline",
    "StandardPipeline",
]

