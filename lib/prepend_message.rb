#!/usr/bin/env ruby

# ===============================================================
# = A utility to prepend a message to the file supplied by ARGV =
# ===============================================================

require "fileutils"
require "tempfile"
require "optparse"

options = {}

file = OptionParser.new do |opts|
  opts.on("-m", "--msg MESSAGE", "Message to prepend to the file") do |p|
    options[:message] = p
  end
end.parse(ARGV)[0]

tempfile = Tempfile.open("tempfile")

begin
  tempfile.write(options[:message])
  IO.readlines(file).each do |line|
    tempfile.write line
  end
  FileUtils.mv(tempfile.path, file)
ensure
  tempfile.close
  tempfile.unlink
end
