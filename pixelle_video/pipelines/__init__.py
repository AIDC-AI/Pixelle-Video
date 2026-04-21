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
from pixelle_video.pipelines.linear import LinearVideoPipeline, PipelineContext
from pixelle_video.pipelines.standard import StandardPipeline, run as run_standard
from pixelle_video.pipelines.custom import CustomPipeline
from pixelle_video.pipelines.asset_based import AssetBasedPipeline, run as run_asset_based
from pixelle_video.pipelines import action_transfer, digital_human, i2v

PIPELINE_REGISTRY = {
    "standard": run_standard,
    "digital_human": digital_human.run,
    "i2v": i2v.run,
    "action_transfer": action_transfer.run,
    "asset_based": run_asset_based,
}

__all__ = [
    "BasePipeline",
    "LinearVideoPipeline",
    "PipelineContext",
    "StandardPipeline",
    "CustomPipeline",
    "AssetBasedPipeline",
    "PIPELINE_REGISTRY",
]
