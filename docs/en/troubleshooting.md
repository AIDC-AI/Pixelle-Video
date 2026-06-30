# Troubleshooting

Having issues? Here are solutions to common problems.

---

## Installation Issues

### Dependency installation failed

```bash
# Clean cache
uv cache clean

# Reinstall
uv sync
```

---

## Configuration Issues

### ComfyUI connection failed

**Possible Causes**:
- ComfyUI not running
- Incorrect URL configuration
- Firewall blocking

**Solutions**:
1. Confirm ComfyUI is running
2. Check URL configuration (default `http://127.0.0.1:8188`)
3. Test by accessing ComfyUI address in browser
4. Check firewall settings

### LLM API call failed

**Possible Causes**:
- Incorrect API Key
- Network issues
- Insufficient balance

**Solutions**:
1. Verify API Key is correct
2. Check network connection
3. Review error message details
4. Check account balance

---

## Generation Issues

### Video generation failed

**Possible Causes**:
- Corrupted workflow file
- Models not downloaded
- Insufficient resources

**Solutions**:
1. Check if workflow file exists
2. Confirm ComfyUI has downloaded required models
3. Check disk space and memory

### Image generation failed

**Solutions**:
1. Check if ComfyUI is running properly
2. Try manually testing workflow in ComfyUI
3. Check workflow configuration

### TTS generation failed

**Solutions**:
1. Check if TTS workflow is correct
2. If using voice cloning, check reference audio format
3. Review error logs

---

## Performance Issues

### Slow generation speed

**Optimization Tips**:
1. Use local ComfyUI (faster than cloud)
2. Reduce number of scenes
3. Use faster LLM (e.g., Qianwen)
4. Check network connection

---

## Other Issues

Still having problems?

1. Check project [GitHub Issues](https://github.com/woaiACE/Pixelle-Video/issues)
2. Submit a new Issue describing your problem
3. Include error logs and configuration details for quick diagnosis

---

## View Logs

Log files are located in project root:
- `api_server.log` - API service logs
- `test_output.log` - Test logs

