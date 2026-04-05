#!/data/data/com.termux/files/usr/bin/bash

# 进入仓库目录
cd ~/nauxij.github.io || { echo "错误：找不到仓库目录"; exit 1; }

# 同步远程仓库，解决分支分叉
echo "正在同步远程仓库..."
git fetch --all
git reset --hard origin/main

# 复制音乐文件
echo "正在复制音乐文件..."
cp ~/storage/music/* .

# 提交并推送
echo "正在提交修改..."
git add .
git commit -m "上传音乐文件"

echo "正在推送到 Gitee..."
git push -f origin main
