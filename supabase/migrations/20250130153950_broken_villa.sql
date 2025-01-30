/*
  # Fix brands table RLS policy

  1. Changes
    - Update RLS policy to allow authenticated users to insert their own brands
    - Add policy for inserting new brands
  
  2. Security
    - Maintains security by ensuring users can only manage their own brands
    - Allows new users to create brands with their user_id
*/

DROP POLICY IF EXISTS "Users can manage their own brands" ON brands;

CREATE POLICY "Users can read their own brands"
  ON brands
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brands"
  ON brands
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brands"
  ON brands
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brands"
  ON brands
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);