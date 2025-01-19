-- Create function to check if all reviews are approved and update offer status
CREATE OR REPLACE FUNCTION check_reviews_and_update_offer_status()
RETURNS TRIGGER AS $$
DECLARE
  v_offer_id uuid;
  v_all_approved boolean;
  v_any_needs_improvement boolean;
BEGIN
  -- Get the offer_id for this review
  SELECT offer_id INTO v_offer_id
  FROM offer_review_requests req
  WHERE req.id = NEW.request_id;

  -- Check if all reviews for this offer are approved
  WITH review_counts AS (
    SELECT 
      COUNT(*) FILTER (WHERE r.status = 'approved') as approved_count,
      COUNT(*) FILTER (WHERE r.status = 'needs_improvement') as needs_improvement_count,
      COUNT(*) as total_count
    FROM offer_reviews r
    JOIN offer_review_requests req ON r.request_id = req.id
    WHERE req.offer_id = v_offer_id
  )
  SELECT 
    approved_count = total_count,
    needs_improvement_count > 0
  INTO 
    v_all_approved,
    v_any_needs_improvement
  FROM review_counts;

  -- Update offer status if all reviews are approved
  IF v_all_approved THEN
    UPDATE offer_records
    SET 
      status = 'Approved',
      updated_at = now()
    WHERE id = v_offer_id;
  ELSIF v_any_needs_improvement THEN
    UPDATE offer_records
    SET 
      status = 'Draft',
      updated_at = now()
    WHERE id = v_offer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function when a review is updated
DROP TRIGGER IF EXISTS update_offer_status_on_review_change ON offer_reviews;
CREATE TRIGGER update_offer_status_on_review_change
  AFTER INSERT OR UPDATE OF status
  ON offer_reviews
  FOR EACH ROW
  EXECUTE FUNCTION check_reviews_and_update_offer_status();